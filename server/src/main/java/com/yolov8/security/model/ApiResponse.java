package com.yolov8.security.model;

public class ApiResponse<T> {
    
    private String status;
    private String message;
    private T data;

    // Constructor
    public ApiResponse(String status, String message, T data) {
        this.status = status;
        this.message = message;
        this.data = data;
    }

    // Getters
    public String getStatus() {
        return status;
    }
    public String getMessage() {
        return message;
    }
    public T getData() {
        return data;
    }

    // Setters
    public void setStatus(String status) {
        this.status = status;
    }
    public void setMessage(String message) {
        this.message = message;
    }
    public void setData(T data) {
        this.data = data;
    }

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<T>("success", null, data);
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        return new ApiResponse<T>("success", message, data);
    }

    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<T>("error", message, null);
    }
}
