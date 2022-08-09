
export function registerHandlebarsHelpers() {
    Handlebars.registerHelper("arrayLookup", (array, property, propertyValue) => {
        if (Array.isArray(array)) {
            return array.find(i => i[property] === propertyValue);
        }
    });
}
