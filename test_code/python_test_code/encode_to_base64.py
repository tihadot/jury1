import base64


def encode_file_to_base64(filepath):
    """
    Encodes the content of a file to a base64 string.

    Parameters:
    filepath (str): The path to the file that needs to be encoded.

    Returns:
    str: The base64 encoded string of the file's content.
    """
    with open(filepath, "rb") as file:
        encoded_content = base64.b64encode(file.read())
        return encoded_content.decode("utf-8")


if __name__ == "__main__":
    """
    Main section for executing the file encoding function.

    Encodes the content of main.py and helper.py to base64 strings and prints them to the console.
    """
    encoded_main = encode_file_to_base64("main.py")
    encoded_helper = encode_file_to_base64("helper.py")
    print("Encoded main.py:\n", encoded_main)
    print("Encoded helper.py:\n", encoded_helper)
