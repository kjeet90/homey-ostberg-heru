declare global {
    interface ModbusRange {
        start: number;
        count: number;
        // When the unit refuses to read this range, skip it instead of failing the whole poll. Used for registers that older firmware may not have.
        optional?: boolean;
    }
    // A register type can be read in several requests, as one Modbus request reads at most 125 registers
    type ModbusRanges = ModbusRange | ModbusRange[];
    interface ModbusRegisters {
        coils: ModbusRanges;
        discreteInputs: ModbusRanges;
        inputRegisters: ModbusRanges;
        holdingRegisters: ModbusRanges;
    }

}

export { }
