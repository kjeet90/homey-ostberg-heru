import Homey from 'homey';
const { v4: uuid } = require('uuid');
import { alarms as Gen3Alarms } from './constants';

class Gen3RemoteDriver extends Homey.Driver {
    async onInit() {
        this.homey.flow.getActionCard('set_regulation_mode_gen3').registerRunListener((args, _state) => args.device.setRegulationMode(args.mode));
        this.homey.flow.getActionCard('set_heater_enabled').registerRunListener((args, _state) => args.device.setHeaterEnabled(args.state === '1' ? true : false));
        this.homey.flow.getConditionCard('is_regulation_mode_gen3').registerRunListener((args, _state) => args.device.isRegulationMode(args.mode));
        this.homey.flow.getConditionCard('is_heater_enabled').registerRunListener((args, _state) => args.device.getCapabilityValue('heater_enabled'));
        this.homey.flow
            .getDeviceTriggerCard('specific_alarm_reset')
            .registerRunListener(async (args, state) => args.alarm.id === state.id)
            .registerArgumentAutocompleteListener('alarm', async (query, _args) => {
                const results = [] as { id: string; name: string }[];
                Object.keys(Gen3Alarms).forEach((k) => results.push({ id: k, name: Gen3Alarms[k] }));
                return results.filter((result) => result.name.toLowerCase().includes(query.toLowerCase()));
            });
        this.homey.flow
            .getDeviceTriggerCard('specific_alarm_activated')
            .registerRunListener(async (args, state) => args.alarm.id === state.id)
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
