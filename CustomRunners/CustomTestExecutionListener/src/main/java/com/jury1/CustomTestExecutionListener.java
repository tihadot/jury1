package com.jury1;

import org.junit.platform.launcher.TestExecutionListener;
import org.junit.platform.launcher.TestIdentifier;
import org.junit.platform.launcher.TestPlan;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;

import java.io.FileWriter;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Custom TestExecutionListener that writes test results to a JSON file.
 * 
 * This class is referenced in the
 * META-INF/services/org.junit.platform.launcher.TestExecutionListener file for
 * discovery by the JUnit Platform Launcher.
 */
public class CustomTestExecutionListener implements TestExecutionListener {

    private List<JSONObject> testResults;
    private FileWriter fileWriter;

    /**
     * Constructor.
     */
    public CustomTestExecutionListener() {
        testResults = new ArrayList<>();
        try {
            fileWriter = new FileWriter("./test-results.json", false);
        } catch (IOException e) {
            throw new RuntimeException("Unable to open file for test results.", e);
        }
    }

    /**
     * Called when a test is finished.
     * 
     * @param testIdentifier      The test identifier.
     * @param testExecutionResult The test execution result.
     */
    @Override
    public void executionFinished(TestIdentifier testIdentifier,
            org.junit.platform.engine.TestExecutionResult testExecutionResult) {
        if (testIdentifier.isTest()) {
            JSONObject result = new JSONObject();
            result.put("test", testIdentifier.getDisplayName());
            result.put("status", testExecutionResult.getStatus().toString());

            testExecutionResult.getThrowable().ifPresent(throwable -> result.put("exception", throwable.getMessage()));

            testResults.add(result);
        }
    }

    /**
     * Called when the test plan is finished.
     * 
     * @param testPlan The test plan.
     */
    @Override
    public void testPlanExecutionFinished(TestPlan testPlan) {
        try {
            JSONArray resultsArray = new JSONArray();
            resultsArray.addAll(testResults);

            fileWriter.write(resultsArray.toJSONString());
            fileWriter.flush();
            fileWriter.close();
        } catch (IOException e) {
            throw new RuntimeException("Unable to write test results to file.", e);
        }
    }
}
