import unittest
import base64
from encode_to_base64 import encode_file_to_base64


class TestEncodeToBase64(unittest.TestCase):
    def test_encode_file_to_base64(self):
        # Create a test file with known content
        test_filename = "testfile.txt"
        test_content = "Hello, world!"

        with open(test_filename, "w") as file:
            file.write(test_content)

        # Encode the test file
        encoded_content = encode_file_to_base64(test_filename)
        expected_encoded_content = base64.b64encode(test_content.encode()).decode()

        self.assertEqual(
            encoded_content,
            expected_encoded_content,
            "The Base64 encoding is incorrect",
        )

        # Cleanup: Remove the test file after the test
        import os

        os.remove(test_filename)


if __name__ == "__main__":
    unittest.main()
