import unittest
from helper import greet


class TestHelper(unittest.TestCase):
    def test_greet(self):
        self.assertEqual(greet("world"), "Hello, world!")
        self.assertEqual(greet("user"), "Hello, user!")


if __name__ == "__main__":
    unittest.main()
