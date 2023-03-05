import Homey from 'homey';

class OstbergHeru extends Homey.App {
    /**
     * onInit is called when the app is initialized.
     */
    async onInit() {
        await this.initFlows();
        this.log('OstbergHeru app has been initialized');
    }

    async initFlows() {
        this.log('Initializing flows...');

        // ########## Actions ##########
        this.homey.flow.getActionCard('set_fan_mode').registerRunListener((args, _state) => args.device.setFanMode(args.mode));
        this.homey.flow.getActionCard('list_active_alarms').registerRunListener(async (args, _state) => args.device.listActiveAlarms()); // Advanced flow only
        // TODO: This seems to not work on my Gen 3 system. Investigate later. Removed .homeycompose flow actions
        // this.homey.flow.getActionCard('reset_alarms').registerRunListener((args, _state) => args.device.resetAlarms());
        // this.homey.flow.getActionCard('reset_filter_timer').registerRunListener((args, _state) => args.device.resetFilterTimer());

        // ########## Conditions ##########
        this.homey.flow.getConditionCard('is_fan_mode').registerRunListener((args, _state) => args.device.isFanMode(args.mode));
        this.homey.flow.getConditionCard('is_specific_alarm_active').registerRunListener((args, _state) => args.device.isSpecificAlarmActive(args.alarm));
        this.homey.flow.getConditionCard('is_any_alarm_active').registerRunListener((args, _state) => args.device.isAnyAlarmActive());

        // ########## Triggers ##########

        this.homey.flow.getDeviceTriggerCard('alarm_activated').registerRunListener(async (_args, state) => {
            return { name: state.name, allActive: state.allActive };
        });

        this.homey.flow.getDeviceTriggerCard('alarm_reset').registerRunListener(async (_args, state) => {
            return { name: state.name, allActive: state.allActive };
        });
    }
}

module.exports = OstbergHeru;
