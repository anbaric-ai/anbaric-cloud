class PropertyDefinition {

    id : string;
    required : boolean = false;
    validation : (arg0: any) => boolean = (value : any) => true;

    constructor(id : string) {
        this.id = id;
    }
}

export { PropertyDefinition }