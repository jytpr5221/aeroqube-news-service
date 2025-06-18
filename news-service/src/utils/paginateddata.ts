export class PaginatedResponse{

    public data:any[];
    public totalPages:number;
    public pageSize:number;
    public pageIndex:number;
    public totalCounts:number;
    constructor(
        data:any[],
        totalCounts:number,
        pageSize:number,
        pageIndex:number
    ){
        this.data = data;
        this.totalCounts = totalCounts;
        this.pageSize = pageSize;
        this.pageIndex = pageIndex;
        this.totalPages = Math.ceil(totalCounts / pageSize);
    }
}