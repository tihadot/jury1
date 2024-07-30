#include <doctest.h>
#include <fstream>
#include <sstream>
#include <vector>
#include <iomanip>

class JsonReporter : public doctest::IReporter
{
public:
    // Constructor
    JsonReporter(const doctest::ContextOptions &input_options)
        : options(input_options) {}

    void report_query(const doctest::QueryData &query_data) override
    {
    }

    void test_run_start() override
    {
    }

    void test_run_end(const doctest::TestRunStats &run_stats) override
    {
        std::ofstream file("./test-results.json");
        file << "[\n";
        for (size_t i = 0; i < m_results.size(); ++i)
        {
            file << m_results[i];
            if (i < m_results.size() - 1)
            {
                file << ",";
            }
            file << "\n";
        }
        file << "]";
    }

    void test_case_start(const doctest::TestCaseData &test_case) override
    {
        currentTestName = test_case.m_name;
        failureMessages.clear();
    }

    void test_case_end(const doctest::CurrentTestCaseStats &stats) override
    {
        std::string status = stats.failure_flags == doctest::TestCaseFailureReason::None ? "SUCCESSFUL" : "FAILED";
        std::ostringstream result;
        result << "{"
               << "\"test\": \"" << currentTestName << "\", "
               << "\"status\": \"" << status << "\"";

        if (status != "SUCCESSFUL")
        {
            std::ostringstream failureMessageStream;
            for (const auto &msg : failureMessages)
            {
                failureMessageStream << msg << "\n";
            }
            std::string failureMessage = failureMessageStream.str();
            if (!failureMessage.empty() && failureMessage.back() == '\n')
            {
                failureMessage.pop_back(); // Remove the trailing newline
            }
            result << ", \"exception\": \"" << escape_json_string(failureMessage) << "\"";
        }

        result << "}";

        m_results.push_back(result.str());
        currentTestName.clear();
    }

    void test_case_reenter(const doctest::TestCaseData &) override
    {
    }

    void test_case_exception(const doctest::TestCaseException &e) override
    {
    }

    void subcase_start(const doctest::SubcaseSignature &) override
    {
    }

    void subcase_end() override
    {
    }

    void log_assert(const doctest::AssertData &ad) override
    {
        if (ad.m_failed)
        {
            std::ostringstream ss;
            ss << "Assertion failed: " << ad.m_expr << ", but was " << ad.m_decomp;
            failureMessages.push_back(ss.str());
        }
    }

    void log_message(const doctest::MessageData &md) override
    {
        std::ostringstream ss;
        ss << "Message: " << md.m_string;
        failureMessages.push_back(ss.str());
    }

    void test_case_skipped(const doctest::TestCaseData &) override
    {
    }

private:
    const doctest::ContextOptions &options;
    std::string currentTestName;
    std::vector<std::string> failureMessages;
    std::vector<std::string> m_results;

    std::string escape_json_string(const std::string &input)
    {
        std::ostringstream ss;
        for (auto c : input)
        {
            switch (c)
            {
            case '\"':
                ss << "\\\"";
                break;
            case '\\':
                ss << "\\\\";
                break;
            case '\b':
                ss << "\\b";
                break;
            case '\f':
                ss << "\\f";
                break;
            case '\n':
                ss << "\\n";
                break;
            case '\r':
                ss << "\\r";
                break;
            case '\t':
                ss << "\\t";
                break;
            default:
                if ('\x00' <= c && c <= '\x1f')
                {
                    ss << "\\u"
                       << std::hex << std::setw(4) << std::setfill('0') << (int)c;
                }
                else
                {
                    ss << c;
                }
            }
        }
        return ss.str();
    }
};

REGISTER_LISTENER("json", 0, JsonReporter);
