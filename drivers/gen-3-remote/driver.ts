import Homey from 'homey';
import { v4 as uuid } from 'uuid';
import { alarms as Gen3Alarms } from './constants';
import { WEEKDAYS } from '../utils';

class Gen3RemoteDriver extends Homey.Driver {
    async onInit() {
        // ########## Actions ##########
        this.homey.flow.getActionCard('set_regulation_mode_gen3').registerRunListener(({ device, mode }) => device.setRegulationMode(mode));
        this.homey.flow.getActionCard('set_heater_enabled_gen3').registerRunListener(({ device, state }) => device.setHeaterEnabled(state === '1' ? true : false));
        this.homey.flow.getActionCard('set_week_timer_enabled_gen3').registerRunListener(({ device, state }) => device.setWeekTimerEnabled(state === '1' ? true : false));
        // The weekday ids count down from Monday = 6 to Sunday = 0. They stay like that so existing flows keep working.
        this.homey.flow
            .getActionCard('set_week_timer_program_week_day_gen3')
            .registerRunListener(({ device, program, week_day, state }) => device.updateWeekProgramWeekday(program, WEEKDAYS[6 - parseInt(week_day, 10)], state === '1'));
        this.homey.flow.getActionCard('set_week_timer_program_start_time_gen3').registerRunListener(({ program, time, device }) => {
            const [hour, minute] = time.split(':');
            return device.updateWeekProgramStartTime(program, parseInt(hour,10), parseInt(minute, 10));
        });
        this.homey.flow.getActionCard('set_week_timer_program_end_time_gen3').registerRunListener(({ program, time, device }) => {
            const [hour, minute] = time.split(':');
            return device.updateWeekProgramEndTime(program, parseInt(hour,10), parseInt(minute, 10));
        });
        this.homey.flow.getActionCard('set_week_timer_program_fan_speed_gen3').registerRunListener((args) => args.device.updateWeekProgramFanSpeed(args.program, args.fan_speed));
        this.homey.flow.getActionCard('set_week_timer_program_temperature_gen3').registerRunListener((args) => args.device.updateWeekProgramTemperature(args.program, args.temperature));
        this.homey.flow.getActionCard('sync_clock_gen3').registerRunListener(({ device }) => device.syncClock());

        // ########## Conditions ##########
        this.homey.flow.getConditionCard('is_regulation_mode_gen3').registerRunListener((args) => args.device.isRegulationMode(args.mode));
        this.homey.flow.getConditionCard('is_heater_enabled_gen3').registerRunListener((args) => args.device.getCapabilityValue('heater_enabled_gen3'));
        this.homey.flow.getConditionCard('is_week_timer_enabled_gen3').registerRunListener(({ device }) => device.getCapabilityValue('week_timer_enabled_gen3'));
        this.homey.flow.getConditionCard('is_week_timer_program_active_gen3').registerRunListener(({ device, program }) => device.isWeekTimerProgramActive(program));
        this.homey.flow.getConditionCard('is_function_active_gen3').registerRunListener(({ device, function: fn }) => device.isFunctionActive(fn));
        this.homey.flow.getConditionCard('is_current_fan_speed_gen3').registerRunListener(({ device, speed }) => device.isCurrentFanSpeed(speed));

        // ########## Triggers ##########
        this.homey.flow.getDeviceTriggerCard('function_started_gen3').registerRunListener(async ({ function: fn }, state) => fn === state.function);
        this.homey.flow.getDeviceTriggerCard('function_stopped_gen3').registerRunListener(async ({ function: fn }, state) => fn === state.function);
        this.homey.flow
            .getDeviceTriggerCard('specific_alarm_reset')
            .registerRunListener(async ({ alarm }, state) => alarm.id === state.id)
            .registerArgumentAutocompleteListener('alarm', async (query, _args) => {
                const results = [] as { id: string; name: string }[];
                Object.keys(Gen3Alarms).forEach((k) => results.push({ id: k, name: Gen3Alarms[k] }));
                return results.filter((result) => result.name.toLowerCase().includes(query.toLowerCase()));
            });
        this.homey.flow
            .getDeviceTriggerCard('specific_alarm_activated')
            .registerRunListener(async ({ alarm }, state) => alarm.id === state.id)
            .registerArgumentAutocompleteListener('alarm', async (query, _args) => {
                const results = [] as { id: string; name: string }[];
                Object.keys(Gen3Alarms).forEach((k) => results.push({ id: k, name: Gen3Alarms[k] }));
                return results.filter((result) => result.name.toLowerCase().includes(query.toLowerCase()));
            });

        this.log('Gen3RemoteDriver driver has been initialized');
    }

    async onPair(session: any) {
        await session.showView('ip_address');
        session.setHandler('ip_submitted', async (data: { ip: string; port: number }) => {
            const devices = [
                {
                    name: 'Gen 3 Remote',
                    data: {
                        id: uuid()
                    },
                    settings: {
                        ip: data.ip,
                        port: data.port
                    }
                }
            ];
            return devices;
        });
    }
}

module.exports = Gen3RemoteDriver;
