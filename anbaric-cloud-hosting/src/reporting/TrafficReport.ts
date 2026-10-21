/* One app's traffic in one hour: how many pages it served, and to how many
   different visitors. The hour is its start, as an ISO timestamp in UTC. */
type TrafficHour = {
    app : string,
    hour : string,
    pageviews : number,
    sessions : number,
};

/* Reads back what a TrafficRecorder wrote: every app's traffic, hour by hour,
   over the last so many hours. An hour in which an app served nothing is
   simply absent. */
interface TrafficReport {

    hourly(hours : number) : Promise<Array<TrafficHour>>;

}

export type { TrafficHour, TrafficReport }
