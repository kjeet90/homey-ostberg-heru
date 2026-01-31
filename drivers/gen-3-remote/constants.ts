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
        count: 69
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
