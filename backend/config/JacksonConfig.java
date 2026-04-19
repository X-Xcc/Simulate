package com.yolov8.security.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.StringHttpMessageConverter;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.web.servlet.config.annotation.ContentNegotiationConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.charset.StandardCharsets;
import java.util.List;

@Configuration
public class JacksonConfig {

    @Bean
    public ObjectMapper objectMapper(Jackson2ObjectMapperBuilder builder) {
        ObjectMapper objectMapper = builder.build();
        // 确保使用UTF-8编码
        objectMapper.getFactory().setCharacterEscapes(null);
        objectMapper.enable(SerializationFeature.INDENT_OUTPUT);
        return objectMapper;
    }
    
    @Bean
    public HttpMessageConverter<String> responseBodyConverter() {
        // 确保响应使用UTF-8编码
        return new StringHttpMessageConverter(StandardCharsets.UTF_8);
    }
    
    @Bean
    public WebMvcConfigurer webMvcConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void configureMessageConverters(List<HttpMessageConverter<?>> converters) {
                // 移除默认的StringHttpMessageConverter，使用我们自定义的
                converters.removeIf(converter -> converter instanceof StringHttpMessageConverter);
                converters.add(responseBodyConverter());
            }
            
            @Override
            public void configureContentNegotiation(ContentNegotiationConfigurer configurer) {
                // 确保响应使用UTF-8编码
                configurer.defaultContentType(new MediaType("application", "json", StandardCharsets.UTF_8));
            }
        };
    }
}
