import { generateId } from "./generate-id.js";

export class DocumentProxy {
    constructor(parent, documentType, data) {
        this._parent = parent;
        this._documentType = documentType;
        this._data = data;
        this._isDirty = false;

        this.updateLocalData(data);

        this._data._id = generateId();
    }

    get id() {
        return this._data._id;
    }

    get uuid() {
        return `${this._parent.uuid}.${this._documentType}.${this.id}`;
    }

    updateLocalData(data) {
        for (const key in data) {
            if (key !== "id") {
                this[key] = data[key];
            }
        }
    }

    update(data) {
        this._data = foundry.utils.mergeObject(this._data, data);
        this._isDirty = true;

        this.updateLocalData(data);
    }

    setFlag(domain, flag, value) {
        const key = `flags.${domain}.${flag}`;
        this._data = foundry.utils.mergeObject(this._data, { [key]: value });
        this._isDirty = true;
    }

    async commit() {
        const result = await this._parent.createEmbeddedDocuments(this._documentType, [this._data], { keepId: true });
        return result[0];
    }
}
