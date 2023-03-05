import { alarms as gen3Alarms } from '../gen-3-remote/constants';
export const alarms = {
    ...gen3Alarms,
    pump_alarm_heating: 'Pump alarm - heating',
    pump_alarm_cooling: 'Pump alarm - cooling'
} as { [index: string]: string };

export const registers: ModbusRegisters = {
    coils: {
        start: 0,
        count: 6
    },
    discreteInputs: {
        start: 9,
        count: 27
    },
    inputRegisters: {
        start: 0,
        count: 33
    },
    holdingRegisters: {
        start: 0,
        count: 43
    }
};

export enum SetRegulationModeIQC {
    SUPPLY = 'supply',
    EXTRACT = 'extract',
    ROOM = 'room',
    EXTRACT_SW = 'extract_sw',
    ROOM_SW = 'room_sw'
}

export enum RegulationModeIQC {
    SUPPLY,
    EXTRACT,
    ROOM,
    EXTRACT_SW,
    ROOM_SW
}

export enum FanSpeedIQC {
    OFF,
    MIN,
    STD,
    MAX
}
