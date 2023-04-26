import Homey from 'homey';
const { v4: uuid } = require('uuid');
import { alarms as IQCAlarms } from './constants';

class IQCTouchDriver extends Homey.Driver {
    async onInit() {
        this.homey.flow.getActionCard('set_regulation_mode_iqc').registerRunListener((args, _state) => args.device.setRegulationMode(args.mode));
        this.homey.flow.getConditionCard('is_regulation_mode_iqc').registerRunListener((args, _state) => args.device.isRegulationMode(args.mode));
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
