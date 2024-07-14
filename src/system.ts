export function capitalize(str: string): string {
    if (!str) return str;
    return str[0].toUpperCase() + str.slice(1);
}

export function genId(): string {
    return Math.random().toString(36).slice(2);
}

export function deepCopy(obj: any): any {
    // Check if the input is null or not an object (base case)
    if (obj === null || typeof obj !== "object") {
        return obj;
    }

    // Handle Date
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }

    // Handle Array
    if (Array.isArray(obj)) {
        const arrCopy = [];
        for (let i = 0; i < obj.length; i++) {
            arrCopy[i] = deepCopy(obj[i]);
        }
        return arrCopy;
    }

    // Handle Object
    const objCopy = {};
    
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            (objCopy as any)[key] = deepCopy(obj[key]);
        }
    }
    return objCopy;
}
