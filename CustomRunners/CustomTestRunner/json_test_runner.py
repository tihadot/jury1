import unittest
import json


class JsonTestResult(unittest.TextTestResult):
    """A test result class that can print formatted text results to a stream."""

    def __init__(self, *args, **kwargs):
        """
        Initialise the test result holder.

        :param args: The arguments to pass to the parent class.
        :param kwargs: The keyword arguments to pass to the parent class.
        """

        super(JsonTestResult, self).__init__(*args, **kwargs)
        self.test_results = []

    def addSuccess(self, test):
        """
        Called when a test has completed successfully.

        :param test: The test that has completed successfully.
        """

        super(JsonTestResult, self).addSuccess(test)
        self.test_results.append({"test": str(test), "status": "SUCCESSFUL"})

    def addError(self, test, err):
        """
        Called when a test raises an unexpected exception.

        :param test: The test that has raised an unexpected exception.
        :param err: The exception that was raised.
        """

        super(JsonTestResult, self).addError(test, err)
        self.test_results.append(
            {
                "test": str(test),
                "status": "ERROR",
                "error": self._exc_info_to_string(err, test),
            }
        )

    def addFailure(self, test, err):
        """
        Called when a test fails.

        :param test: The test that has failed.
        :param err: The exception that was raised.
        """

        super(JsonTestResult, self).addFailure(test, err)
        self.test_results.append(
            {
                "test": str(test),
                "status": "FAILED",
                "exception": self._exc_info_to_string(err, test),
            }
        )


class JsonTestRunner(unittest.TextTestRunner):
    """A test runner class that outputs the results in JSON format."""

    def __init__(self, *args, **kwargs):
        """
        Initialise the test runner.

        :param args: The arguments to pass to the parent class.
        :param kwargs: The keyword arguments to pass to the parent class.
        """

        kwargs["resultclass"] = JsonTestResult
        super(JsonTestRunner, self).__init__(*args, **kwargs)

    def run(self, test):
        """
        Run the tests and output the results in JSON format.

        :param test: The test suite to run.
        :return: The test results.
        """

        result = super(JsonTestRunner, self).run(test)
        with open("./test-results.json", "w") as f:
            json.dump(result.test_results, f)
        return result


if __name__ == "__main__":
    """Run the tests using the custom test runner."""

    test_directory = "/usr/src/app/"
    test_suite = unittest.defaultTestLoader.discover(
        start_dir=test_directory, pattern="test*.py"
    )
    JsonTestRunner().run(test_suite)
