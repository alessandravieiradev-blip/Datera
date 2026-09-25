const sku = (raw) => {
    const clean = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
    const parts = clean.match(/^([A-Z]+)(\d+)$/);
    if (!parts) return null;
    return { key: parts[2], group: parts[1] };
};

module.exports = { normalizers: { skuFromFile: sku } };
