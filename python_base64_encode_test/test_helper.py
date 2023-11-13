import unittest
from helper import greet


class TestHelper(unittest.TestCase):
    def test_greet(self):
        self.assertEqual(greet("World"), "Hello, World!")
        self.assertEqual(greet("User"), "Hello, User!")


if __name__ == "__main__":
    unittest.main()
