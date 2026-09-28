/* Loads the properties a job does not yet hold: the keys asked for, or every
   property when asked for none in particular. Absent keys are simply missing
   from the result. */
type PropertyLoader = (keys? : Array<string>) => Promise<Map<string, any>>;

/* A job's properties, read on demand. What a step reads is fetched when it is
   first asked for and kept; what a state prewarms is fetched up front in one
   go; nothing else is ever loaded. Writes are staged and become the job's
   next save - the changed properties and only those.

   The reads are asynchronous because that is what makes the laziness safe:
   nothing a step asks for can come back missing just because it was not
   declared ahead of time. */
class JobProperties {

    private loaded = new Map<string, any>();
    private absent = new Set<string>();
    private staged = new Map<string, any>();
    private complete : boolean;

    constructor(initial : Map<string, any> | Record<string, any> = new Map(), private loader? : PropertyLoader,
                complete : boolean = loader === undefined) {
        this.loaded = initial instanceof Map ? new Map(initial) : new Map(Object.entries(initial));
        this.complete = complete;
    }

    async get(key : string) : Promise<any> {
        if (this.staged.has(key)) return this.staged.get(key);
        if (! this.loaded.has(key) && ! this.absent.has(key) && ! this.complete) await this.prewarm([key]);
        return this.loaded.get(key);
    }

    async has(key : string) : Promise<boolean> {
        return this.staged.has(key) || (await this.get(key)) !== undefined || this.loaded.has(key);
    }

    async getMany(keys : Array<string>) : Promise<Map<string, any>> {
        await this.prewarm(keys);
        return new Map(keys.filter(key => this.staged.has(key) || this.loaded.has(key))
            .map(key => [key, this.staged.has(key) ? this.staged.get(key) : this.loaded.get(key)]));
    }

    /* Fetches, in one call, the keys not yet held - or everything, given no
       keys. A second call for the same keys costs nothing. */
    async prewarm(keys? : Array<string>) : Promise<void> {
        if (this.complete || ! this.loader) return;

        if (keys === undefined) {
            for (const [key, value] of await this.loader()) this.loaded.set(key, value);
            this.absent.clear();
            this.complete = true;
            return;
        }

        const missing = keys.filter(key => ! this.loaded.has(key) && ! this.absent.has(key));
        if (missing.length === 0) return;

        const found = await this.loader(missing);
        for (const key of missing) {
            if (found.has(key)) this.loaded.set(key, found.get(key));
            else this.absent.add(key);
        }
    }

    set(key : string, value : any) : void {
        this.staged.set(key, value);
    }

    // The writes since the last commit: what a save writes, and only that.
    changed() : Map<string, any> {
        return new Map(this.staged);
    }

    // The staged writes are now stored; they read back as loaded values.
    commit() : void {
        for (const [key, value] of this.staged) {
            this.loaded.set(key, value);
            this.absent.delete(key);
        }
        this.staged.clear();
    }

    // Every property, loading whatever is not yet held.
    async toMap() : Promise<Map<string, any>> {
        await this.prewarm();
        return this.snapshot();
    }

    // What is held right now - loaded plus staged - without loading anything.
    snapshot() : Map<string, any> {
        return new Map([...this.loaded, ...this.staged]);
    }

    get isComplete() : boolean {
        return this.complete;
    }

}

export { JobProperties };
export type { PropertyLoader };
