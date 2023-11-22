package com.jury1;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class HelperTest {

    @Test
    public void testGreet() {
        // Arrange
        String name = "world";

        // Act
        String result = Helper.greet(name);

        // Assert
        assertEquals("Hello, world!", result, "The greet method should return the correct greeting message.");
    }
}