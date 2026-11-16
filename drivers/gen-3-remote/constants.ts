import { BaseRegisters } from '../registers';

const discreteInputs = BaseRegisters.discreteInputs;

// Alarm id with the discrete input that reports it
export const alarmInputs = {
    fire_alarm: discreteInputs.FIRE_ALARM,
    rotor_alarm: discreteInputs.ROTOR_ALARM,
    freeze_alarm: discreteInputs.FREEZE_ALARM,
    low_supply_alarm: discreteInputs.LOW_SUPPLY_ALARM,
    low_rotor_temperature_alarm: discreteInputs.LOW_ROTOR_TEMPEARTURE_ALARM,
    temp_sensor_open_circuit_alarm: discreteInputs.TEMP_SENSOR_OPEN_CIRCUIT_ALARM,
    temp_sensor_short_circut_alarm: discreteInputs.TEMP_SENSOR_SHORT_CIRCUIT_ALARM,
    pulser_alarm: discreteInputs.PULSER_ALARM,
    supply_fan_alarm: discreteInputs.SUPPLY_FAN_ALARM,
    extract_fan_alarm: discreteInputs.EXHAUST_FAN_ALARM,
    supply_filter_alarm: discreteInputs.SUPPLY_FILTER_ALARM,
    extract_filter_alarm: discreteInputs.EXHAUST_FILTER_ALARM,
    filter_timer_alarm: discreteInputs.FILTER_TIMER_ALARM
} as { [id: string]: number };

export const gen3AlarmInputs = {
    ...alarmInputs,
    carbondioxide_boost_alarm: discreteInputs.CO2_BOOST
} as { [id: string]: number };

// Operating functions shown by the unit, with the discrete input that reports whether they are active
export const functionInputs = {
    heating: discreteInputs.HEATING,
    heat_recovery: discreteInputs.RECOVERING_HEAT_COLD,
    co2_boost: discreteInputs.CO2_BOOST,
    rh_boost: discreteInputs.RH_BOOST
} as { [fn: string]: number };

export const alarms = {
    fire_alarm: 'Fire alarm',
    rotor_alarm: 'Rotor alarm',
    freeze_alarm: 'Freeze alarm',
    low_supply_alarm: 'Low supply alarm',
    low_rotor_temperature_alarm: 'Low rotor temperature alarm',
    temp_sensor_open_circuit_alarm: 'Temp. sensor open circuit alarm',
    temp_sensor_short_circut_alarm: 'Temp. sensor short circuit alarm',
    pulser_alarm: 'Pulser alarm',
    supply_fan_alarm: 'Supply fan alarm',
    extract_fan_alarm: 'Extract fan alarm',
    supply_filter_alarm: 'Supply filter alarm',
    extract_filter_alarm: 'Extract filter alarm',
    filter_timer_alarm: 'Filter timer alarm'
} as { [index: string]: string };

export const registers: ModbusRegisters = {
    coils: {
        start: 0,
        count: 6
    },
    discreteInputs: {
        start: 9,
        count: 25
    },
    inputRegisters: {
        start: 0,
        count: 33
    },
    holdingRegisters: {
        start: 0,
        count: 116
    }
};

export enum SetRegulationModeGen3 {
    SUPPLY = 'supply',
    EXTRACT = 'extract',
    ROOM = 'room'
}

export enum RegulationModeGen3 {
    SUPPLY,
    EXTRACT,
    ROOM
}

export enum FanSpeedGen3 {
    OFF,
    MIN,
    STD,
    MOD,
    MAX
}
