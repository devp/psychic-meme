"""
Tests for: User Profile Management
"""
import pytest


@pytest.mark.skip(reason="TODO: Implement test")
def test_user_updates_their_email_address():
    """
    Scenario: User updates their email address

    Given a logged-in user with email "old@example.com"
    When they update their email to "new@example.com"
    Then their profile shows the new email
    And they receive a confirmation email
    """
    assert False, "TODO: Implement this test"


@pytest.mark.skip(reason="TODO: Implement test")
def test_user_cannot_use_an_already_registered_email():
    """
    Scenario: User cannot use an already registered email

    Given a logged-in user
    And another user already has email "taken@example.com"
    When they try to update their email to "taken@example.com"
    Then they see an error message
    And their email remains unchanged
    """
    assert False, "TODO: Implement this test"
