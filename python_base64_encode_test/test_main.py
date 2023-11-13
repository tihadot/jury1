import unittest
import io
import sys
from main import main


class TestMain(unittest.TestCase):
    def test_main_output(self):
        captured_output = io.StringIO()  # Create StringIO object
        sys.stdout = captured_output  # Redirect stdout
        main()  # Call the main function
        sys.stdout = sys.__stdout__  # Reset redirect
        self.assertEqual(captured_output.getvalue().strip(), "Hello, World!")


if __name__ == "__main__":
    unittest.main()
