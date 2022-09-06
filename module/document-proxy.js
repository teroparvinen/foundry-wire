import { generateId } from "./generate-id.js";

export class DocumentProxy {
    constructor(parent, documentType, data) {
        this.parent = parent;
        this.documentType = documentType;
        this.data = data;
        this.isDirty = false;

        this.data._id = generateId();
    }

    get id() {
        return this.data._id;
    }

    get uuid() {
        return `${this.parent.uuid}.${this.documentType}.${this.id}`;
    }

    update(data) {
        this.data = foundry.utils.mergeObject(this.data, data);
        this.isDirty = true;
    }

    setFlag(domain, flag, value) {
        const key = `flags.${domain}.${flag}`;
        this.data = foundry.utils.mergeObject(this.data, { [key]: value });
        this.isDirty = true;
    }

    async commit() {
        const result = await this.parent.createEmbeddedDocuments(this.documentType, [this.data], { keepId: true });
        return result[0];
    }
}
