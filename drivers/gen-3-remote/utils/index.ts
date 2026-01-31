export function convertNumberToArrayOfBooleans(number: number, arrayLength: number) {
    const convertedArray = number.toString(2).split('');
    return [
        ...Array.from({length: arrayLength - convertedArray.length}, () => '0'),
        ...convertedArray
    ].map(value => (/1/).test(value));
}

export function convertArrayOfBooleansToNumber(array: boolean[]) {
    return parseInt(array.map((value) => value ? '1' : '0').join(''), 2);
}
