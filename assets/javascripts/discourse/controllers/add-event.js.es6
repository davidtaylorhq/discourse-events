import { default as computed, observes } from 'ember-addons/ember-computed-decorators';
import { setupEvent, timezoneLabel } from '../lib/date-utilities';

const DATE_FORMAT = 'YYYY-MM-DD';
const TIME_FORMAT = 'HH:mm';
const TIMEZONES = moment.tz.names().reduce((names, n) => {
  if (n.indexOf('+') === -1) {
    const offset = moment.tz(n).format('Z');
    const name = timezoneLabel(n);
    names.push({
      id: n,
      name,
      offset
    });
  }

  return names;
}, []).sort((a, b) => {
  return parseInt(a.offset.replace(':', ''), 10) -
         parseInt(b.offset.replace(':', ''), 10);
});

export default Ember.Controller.extend({
  title: 'add_event.modal_title',
  endEnabled: false,
  allDay: false,
  timezones: TIMEZONES,

  setup() {
    const event = this.get('model.event');
    const timezone = event && event.timezone ? event.timezone : moment.tz.guess();
    const { start, end, allDay } = setupEvent(event);

    if (allDay) {
      let startDate = start.format(DATE_FORMAT);
      let endDate = end.format(DATE_FORMAT);
      let endEnabled = moment(endDate).isAfter(startDate, 'day');

      return this.setProperties({
        allDay,
        startDate,
        endDate,
        endEnabled,
        timezone
      });
    }

    let s = start || this.nextInterval();
    let startDate = s.format(DATE_FORMAT);
    let startTime = s.format(TIME_FORMAT);

    this.setProperties({ startDate, startTime, timezone });
    this.setupTimePicker('start');

    if (event && event.end) {
      this.set('endEnabled', true);
    }
  },

  setupTimePicker(type) {
    const time = this.get(`${type}Time`);
    Ember.run.scheduleOnce('afterRender', this, () => {
      const $timePicker = $(`#${type}-time-picker`);
      $timePicker.timepicker({ timeFormat: 'H:i' });
      $timePicker.timepicker('setTime', time);
      $timePicker.change(() => this.set(`${type}Time`, $timePicker.val()));
    });
  },

  @observes('endEnabled')
  setupOnEndEnabled() {
    const endEnabled = this.get('endEnabled');
    if (endEnabled) {
      const event = this.get('model.event');
      const eventStart = this.get('eventStart');
      const end = event && event.end ? moment(event.end) : moment(eventStart).add(1, 'hours');

      const endDate = end.format(DATE_FORMAT);
      this.set('endDate', endDate);

      const allDay = this.get('allDay');
      if (!allDay) {
        const endTime = end.format(TIME_FORMAT);
        this.setProperties({ endDate, endTime });
        this.setupTimePicker('end');
      }
    }
  },

  @observes('allDay')
  setupOnAllDayRevert() {
    const allDay = this.get('allDay');
    if (!allDay) {
      const start = this.nextInterval();
      const startTime = start.format(TIME_FORMAT);
      this.set('startTime', startTime);
      this.setupTimePicker('start');

      const endEnabled = this.get('endEnabled');
      if (endEnabled) {
        const end = moment(start).add(1, 'hours');
        const endTime = end.format(TIME_FORMAT);
        this.set('endTime', endTime);
        this.setupTimePicker('end');
      }
    }
  },

  nextInterval() {
    const ROUNDING = 30 * 60 * 1000;
    return moment(Math.ceil((+moment()) / ROUNDING) * ROUNDING);
  },

  @computed('startDate', 'startTime', 'endDate', 'endTime', 'endEnabled', 'allDay')
  notReady(startDate, startTime, endDate, endTime, endEnabled, allDay) {
    const datesInvalid = endEnabled ? moment(startDate).isAfter(moment(endDate)) : false;
    if (allDay) return datesInvalid;
    const timesValid = endEnabled ? moment(startTime).isAfter(moment(endTime)) : false;
    return datesInvalid || timesValid;
  },

  resetProperties() {
    this.setProperties({
      startDate: null,
      startTime: null,
      endDate: null,
      endTime: null,
      endEnabled: false,
      allDay: false
    });
  },

  actions: {
    clear() {
      this.resetProperties();
      this.get('model.update')(null);
    },

    addEvent() {
      const startDate = this.get('startDate');
      let event = null;

      if (startDate) {
        const timezone = this.get('timezone');
        let start = moment().tz(timezone);

        const allDay = this.get('allDay');
        const sMonth = moment(startDate).month();
        const sDate = moment(startDate).date();
        const startTime = this.get('startTime');
        let sHour = allDay ? 0 : moment(startTime, 'HH:mm').hour();
        let sMin = allDay ? 0 : moment(startTime, 'HH:mm').minute();

        event = {
          timezone,
          all_day: allDay,
          start: start.month(sMonth).date(sDate).hour(sHour).minute(sMin).toISOString()
        };

        const endEnabled = this.get('endEnabled');
        if (endEnabled) {
          let end = moment().tz(timezone);
          const endDate = this.get('endDate');
          const eMonth = moment(endDate).month();
          const eDate = moment(endDate).date();
          const endTime = this.get('endTime');
          let eHour = allDay ? 0 : moment(endTime, 'HH:mm').hour();
          let eMin = allDay ? 0 : moment(endTime, 'HH:mm').minute();

          event['end'] = end.month(eMonth).date(eDate).hour(eHour).minute(eMin).toISOString();
        }
      }

      console.log(event);

      this.get('model.update')(event);
      this.resetProperties();
      this.send("closeModal");
    }
  }
});
