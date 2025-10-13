const CUSTOM_SYMBOLS = {
    "__checkmark": "\u2713", // ✓
    "__B_RoutingNumber": "011275484",
    "__B_Name": "Bangore Savings Bank",
    "__B_FullAdress": "11 Hamlin Way, Bangor, ME 04401",
    "__B_Streeet": "11 Hamlin Way",
    "__B_City": "Bangor",
    "__B_State": "ME",
    "__B_Zip": "04401",
};

// automatically build reverse lookup
const CUSTOM_TOKENS = Object.fromEntries(
    Object.entries(CUSTOM_SYMBOLS).map(([uuid, symbol]) => [symbol, uuid])
);

function resolveCustomTextValue(value) {
    if (value == null) return "";
    if (value == "__today") {
        const date = new Date(); // Or any other Date object
        const formattedDate = date.toLocaleDateString('en-US');
        return formattedDate;
    }
    return CUSTOM_SYMBOLS[value] || value;
}

function resolveSymbolToToken(symbol) {
    if (symbol == null) return "";
    return CUSTOM_TOKENS[symbol] || symbol;
}
