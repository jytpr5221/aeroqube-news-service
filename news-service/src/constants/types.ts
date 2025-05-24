export enum UserType  {
    ADMIN= "admin",
    SUPERADMIN='superadmin',
    EDITOR= "editor",
    USER= "user",
    REPORTER= "reporter",
    PENDINGREPORTER= "pending-reporter"
  };


export enum NewsServiceEvents {
    UPLOAD_NEWS = 'upload-news',
    UPDATE_NEWS = 'update-news',
    VERIFY_NEWS = 'verify-news',
    DELETE_NEWS = 'delete-news'
}


export enum CategoryEvents {
  CREATE_CATEGORY = 'create-category',
  UPDATE_CATEGORY = 'update-category',
  DELETE_CATEGORY = 'delete-category'
}