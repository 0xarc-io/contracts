
export type StateMutability = "pure" | "view" | "payable" | "nonpayable";
export type Visibility = "public" | "private" | "internal" | "external";

export type SolidityType = 
    ArrayType | BooleanType | AddressType| StringType | ByteType | DynamicBytesType
    | UintType | IntType | BytesType | VoidType | TupleType

export type ArrayType = { type: "array"; itemType: SolidityType; size?: number }
export type UintType = { type: "uint"; bits: number }
export type IntType = { type: "int"; bits: number }
export type BytesType = { type: "bytes"; bits: number }
export type BooleanType = { type: "boolean" }
export type AddressType = { type: "address" }
export type StringType = { type: "string" }
export type DynamicBytesType = { type: "dynamic-bytes" }
export type ByteType = { type: "byte" }
export type TupleType = { type: "tuple"; isStruct: boolean; components: Array<SoliditySymbol> };

export type VoidType = { type: "void" }

export type SoliditySymbol = {
    type: SolidityType;
    name: string;
};

export function parseSolidityType(raw: string, components?: Array<SoliditySymbol>, internal?: string): SolidityType {

    const lastChar = raw[raw.length-1];
    if (lastChar == ']') {
        return parseArrayType(raw, components);
    }

    switch (raw) {
        case "bool": return {type: "boolean"}
        case "address": return {type: "address"}
        case "string": return {type: "string"}
        case "byte": return {type: "byte"}
        case "bytes": return {type: "dynamic-bytes"}
        case "tuple": 
            if (!components) throw new Error("Tuple specified without components!");
            const isStruct = internal != null && internal.startsWith('struct');
            return { type: "tuple", isStruct: isStruct, components };
    }

    if (raw.startsWith("uint")) {
        return getPrefixedType(raw, "uint", 256);
    }
    if (raw.startsWith("int")) {
        return getPrefixedType(raw, "int", 256);
    }
    if (raw.startsWith("bytes")) {
        return getPrefixedType(raw, "bytes", 1);
    }

    throw new Error("Unknown Type: " + raw);
}

function parseArrayType(rawType: string, components?: Array<SoliditySymbol>): ArrayType {

    let finishArrayTypeIndex = rawType.length - 2;
    while (rawType[finishArrayTypeIndex] !== '[') {
        finishArrayTypeIndex--;
    }

    const arraySizeRaw = rawType.slice(finishArrayTypeIndex + 1, rawType.length - 1);
    const arraySize = arraySizeRaw.length > 0 ? parseInt(arraySizeRaw) : undefined;

    const remaining = rawType.slice(0, finishArrayTypeIndex);

    return { type: "array", itemType: parseSolidityType(remaining, components), size: arraySize}
}

function getPrefixedType(rawType: string, prefix: "bytes" | "uint" | "int", defaultValue: number): SolidityType  {
    const bits = rawType.length > prefix.length ? parseInt(rawType.slice(prefix.length)) : defaultValue;
    return { type: prefix, bits: bits };
}