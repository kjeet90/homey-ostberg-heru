import Homey from 'homey';
import { v4 as uuid } from 'uuid';
import { alarms as Gen3Alarms } from './constants';
import { convertArrayOfBooleansToNumber } from './utils';

class Gen3RemoteDriver extends Homey.Driver {
    async onInit() {
        // ########## Actions ##########
        this.homey.flow.getActionCard('set_regulation_mode_gen3').registerRunListener(({ device, mode }) => device.setRegulationMode(mode));
        this.homey.flow.getActionCard('set_heater_enabled_gen3').registerRunListener(({ device, state }) => device.setHeaterEnabled(state === '1' ? true : false));
        this.homey.flow.getActionCard('set_week_timer_enabled_gen3').registerRunListener(({ device, state }) => device.setWeekTimerEnabled(state === '1' ? true : false));
        this.homey.flow.getActionCard('set_week_timer_program_week_day_gen3').registerRunListener(({ device, program, week_day, state }) => {
            const settings = device.getSettings();

            const weekdays = [
                settings[`program_${program}_week_day_sunday`],
                settings[`program_${program}_week_day_saturday`],
                settings[`program_${program}_week_day_friday`],
                settings[`program_${program}_week_day_thursday`],
                settings[`program_${program}_week_day_wednesday`],
                settings[`program_${program}_week_day_tuesday`],
                settings[`program_${program}_week_day_monday`]
            ];

            weekdays[parseInt(week_day, 10)] = state === '1';

            device.updateWeekProgramWeekdays(
                program,
                convertArrayOfBooleansToNumber(weekdays)
            )
        });
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

        // ########## Conditions ##########
        this.homey.flow.getConditionCard('is_regulation_mode_gen3').registerRunListener((args) => args.device.isRegulationMode(args.mode));
        this.homey.flow.getConditionCard('is_heater_enabled_gen3').registerRunListener((args) => args.device.getCapabilityValue('heater_enabled_gen3'));

        // ########## Triggers ##########
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
