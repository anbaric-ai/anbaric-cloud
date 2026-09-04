/* An `example` is carried into the workflow definition, so tools that start a
   job - the admin console's Start dialog, generated docs - can offer a
   realistic value rather than an empty placeholder. */
class PropertyDefinition {

    id : string;
    required : boolean = false;
    example? : any;
    validation : (arg0: any) => boolean = (value : any) => true;

    constructor(id : string) {
        this.id = id;
    }
}

export { PropertyDefinition }