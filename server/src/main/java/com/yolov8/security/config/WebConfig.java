package com.yolov8.security.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.StringHttpMessageConverter;
import org.springframework.web.servlet.config.annotation.ContentNegotiationConfigurer;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.charset.StandardCharsets;
import java.util.List;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // External web assets (dev: file:web/) take priority over classpath
        registry.addResourceHandler("/static/css/**")
                .addResourceLocations("file:web/css/");
        registry.addResourceHandler("/static/js/**")
                .addResourceLocations("file:web/js/");
        registry.addResourceHandler("/css/**")
                .addResourceLocations("file:web/css/");
        registry.addResourceHandler("/js/**")
                .addResourceLocations("file:web/js/");
        // Fallback: classpath static resources (e.g. images bundled in WAR)
        registry.addResourceHandler("/static/**")
                .addResourceLocations("classpath:/static/");
    }

    @Override
    public void configureMessageConverters(List<HttpMessageConverter<?>> converters) {
        converters.removeIf(converter -> converter instanceof StringHttpMessageConverter);
        converters.add(new StringHttpMessageConverter(StandardCharsets.UTF_8));
    }

    @Override
    public void configureContentNegotiation(ContentNegotiationConfigurer configurer) {
        configurer.defaultContentType(new MediaType("application", "json", StandardCharsets.UTF_8));
    }
}
