import { SUCCESS_CODES } from "@constants/statuscodes";


export interface IApiResponse {
    message: string;
    data: any;
    statusCode: number;
    success: boolean;
}

abstract class ApiResponse  {

    private message:string;
    private data:any;
    private statusCode:number;
    private success:boolean;

    constructor(statusCode:number,message:string="success",data:any){
        this.message=message;
        this.data=data;
        this.statusCode=statusCode;
        this.success= statusCode < 400;
    }
}

export class ItemCreatedResponse extends ApiResponse {
    constructor(message:string="Item Created Successfully", data:any){
        super(SUCCESS_CODES.CREATED,message,data);
    }
}

export class ItemUpdatedResponse extends ApiResponse {

    constructor(message:string="Item Updated Successfully", data:any){
        super(SUCCESS_CODES.CREATED,message,data);
    }
}

export class ItemDeletedResponse extends ApiResponse {
    constructor(message:string="Item Deleted Successfully",data:null=null){
        super(SUCCESS_CODES.NO_CONTENT,message,data);
    }
}

export class ItemFetchedResponse extends ApiResponse {
    constructor(message:string="Item Fetched Successfully",data:any){
        super(SUCCESS_CODES.OK,message,data);
    }
}


export  {ApiResponse}