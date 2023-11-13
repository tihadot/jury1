from helper import greet


def main():
    """
    Main function that executes when the script is run.

    This function calls the 'greet' function from the 'helper' module,
    passing "World" as an argument. The result from 'greet' is then printed.
    This script is a simple demonstration of using a function from another
    module to display a greeting message.
    """
    print(greet("World"))


if __name__ == "__main__":
    """
    This conditional statement checks if the script is being run directly.
    If so, it calls the 'main' function to execute the script's primary logic.
    """
    main()
