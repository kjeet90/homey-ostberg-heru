import Homey from 'homey';
const { v4: uuid } = require('uuid');
import { alarms as IQCAlarms } from './constants';

// Flow cards give the time as HH:mm
function parseTime(time: string) {
    const [hour, minute] = time.split(':').map((part) => parseInt(part, 10));
    return { hour, minute };
}

// Flow cards give the date as dd-mm-yyyy, the device uses YYYY-MM-DD like its settings
function toIsoDate(date: string) {
    const [day, month, year] = date.split('-');
    return `${year}-${month}-${day}`;
}

class IQCTouchDriver extends Homey.Driver {
    async onInit() {
        // ########## Actions ##########
        this.homey.flow.getActionCard('set_regulation_mode_iqc').registerRunListener((args, _state) => args.device.setRegulationMode(args.mode));
        this.homey.flow.getActionCard('set_heater_enabled_iqc').registerRunListener((args, _state) => args.device.setHeaterEnabled(args.state === '1' ? true : false));
        this.homey.flow.getActionCard('set_preheater_enabled_iqc').registerRunListener((args, _state) => args.device.setPreheaterEnabled(args.state === '1' ? true : false));
        this.homey.flow.getActionCard('sync_clock_iqc').registerRunListener(({ device }) => device.syncClock());

        this.homey.flow.getActionCard('set_week_schedule_enabled_iqc').registerRunListener(({ device, state }) => device.setWeekScheduleEnabled(state === '1'));
        this.homey.flow.getActionCard('set_week_schedule_program_enabled_iqc').registerRunListener(({ device, program, state }) => device.setWeekProgramEnabled(Number(program), state === '1'));
        this.homey.flow
            .getActionCard('set_week_schedule_program_week_day_iqc')
            .registerRunListener(({ device, program, week_day, state }) => device.setWeekProgramWeekday(Number(program), week_day, state === '1'));
        this.homey.flow.getActionCard('set_week_schedule_program_start_time_iqc').registerRunListener(({ device, program, time }) => {
            const { hour, minute } = parseTime(time);
            return device.setWeekProgramStartTime(Number(program), hour, minute);
        });
        this.homey.flow.getActionCard('set_week_schedule_program_end_time_iqc').registerRunListener(({ device, program, time }) => {
            const { hour, minute } = parseTime(time);
            return device.setWeekProgramEndTime(Number(program), hour, minute);
        });
        this.homey.flow
            .getActionCard('set_week_schedule_program_fan_speed_iqc')
            .registerRunListener(({ device, program, fan_speed }) => device.setWeekProgramFanSpeed(Number(program), Number(fan_speed)));
        this.homey.flow
            .getActionCard('set_week_schedule_program_temperature_mode_iqc')
            .registerRunListener(({ device, program, mode }) => device.setWeekProgramTemperatureMode(Number(program), Number(mode)));

        this.homey.flow.getActionCard('set_holiday_schedule_enabled_iqc').registerRunListener(({ device, state }) => device.setHolidayScheduleEnabled(state === '1'));
        this.homey.flow.getActionCard('set_holiday_program_enabled_iqc').registerRunListener(({ device, program, state }) => device.setHolidayProgramEnabled(Number(program), state === '1'));
        this.homey.flow.getActionCard('set_holiday_program_start_iqc').registerRunListener(({ device, program, date, time }) => {
            const { hour, minute } = parseTime(time);
            return device.setHolidayProgramStart(Number(program), toIsoDate(date), hour, minute);
        });
        this.homey.flow.getActionCard('set_holiday_program_end_iqc').registerRunListener(({ device, program, date, time }) => {
            const { hour, minute } = parseTime(time);
            return device.setHolidayProgramEnd(Number(program), toIsoDate(date), hour, minute);
        });
        this.homey.flow
            .getActionCard('set_holiday_program_fan_speed_iqc')
            .registerRunListener(({ device, program, fan_speed }) => device.setHolidayProgramFanSpeed(Number(program), Number(fan_speed)));
        this.homey.flow
            .getActionCard('set_holiday_program_temperature_mode_iqc')
            .registerRunListener(({ device, program, mode }) => device.setHolidayProgramTemperatureMode(Number(program), Number(mode)));

        // ########## Conditions ##########
        this.homey.flow.getConditionCard('is_regulation_mode_iqc').registerRunListener((args, _state) => args.device.isRegulationMode(args.mode));
        this.homey.flow.getConditionCard('is_heater_enabled_iqc').registerRunListener((args, _state) => args.device.getCapabilityValue('heater_enabled_iqc'));
        this.homey.flow.getConditionCard('is_preheater_enabled_iqc').registerRunListener((args, _state) => args.device.getCapabilityValue('preheater_enabled_iqc'));
        this.homey.flow.getConditionCard('is_function_active_iqc').registerRunListener(({ device, function: fn }) => device.isFunctionActive(fn));
        this.homey.flow.getConditionCard('is_current_fan_speed_iqc').registerRunListener(({ device, speed }) => device.isCurrentFanSpeed(speed));
        this.homey.flow.getConditionCard('is_week_schedule_enabled_iqc').registerRunListener(({ device }) => device.getCapabilityValue('week_schedule_enabled_iqc'));
        this.homey.flow.getConditionCard('is_week_schedule_program_active_iqc').registerRunListener(({ device, program }) => device.isWeekProgramActive(program));
        this.homey.flow.getConditionCard('is_holiday_schedule_enabled_iqc').registerRunListener(({ device }) => device.getCapabilityValue('holiday_schedule_enabled_iqc'));

        // ########## Triggers ##########
        this.homey.flow.getDeviceTriggerCard('function_started_iqc').registerRunListener(async ({ function: fn }, state) => fn === state.function);
        this.homey.flow.getDeviceTriggerCard('function_stopped_iqc').registerRunListener(async ({ function: fn }, state) => fn === state.function);
        this.homey.flow
            .getDeviceTriggerCard('specific_alarm_reset')
            .registerRunListener(async (args, state) => args.alarm.id === state.id)
            .registerArgumentAutocompleteListener('alarm', async (query, _args) => {
                const results = [] as { id: string; name: string }[];
                Object.keys(IQCAlarms).forEach((k) => results.push({ id: k, name: IQCAlarms[k] }));
                return results.filter((result) => result.name.toLowerCase().includes(query.toLowerCase()));
            });
        this.homey.flow
            .getDeviceTriggerCard('specific_alarm_activated')
            .registerRunListener(async (args, state) => args.alarm.id === state.id)
            .registerArgumentAutocompleteListener('alarm', async (query, _args) => {
                const results = [] as { id: string; name: string }[];
                Object.keys(IQCAlarms).forEach((k) => results.push({ id: k, name: IQCAlarms[k] }));
                return results.filter((result) => result.name.toLowerCase().includes(query.toLowerCase()));
            });
        this.log('IQCTouchDriver driver has been initialized');
    }

    async onPair(session: any) {
        await session.showView('ip_address');
        session.setHandler('ip_submitted', async (data: { ip: string; port: number; tcp: boolean }) => {
            const devices = [
                {
                    name: 'IQC Touch',
                    data: {
                        id: uuid()
                    },
                    settings: {
                        ip: data.ip,
                        port: data.port,
                        tcp: data.tcp
                    }
                }
            ];
            return devices;
        });
    }
}

module.exports = IQCTouchDriver;
