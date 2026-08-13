interface Queue {

    enqueue(jobId : string) : Promise<void>;
    dequeueSome() : Promise<Array<string>>;
    schedule(jobId : string, due : Date) : Promise<void>;

}

export { Queue }
