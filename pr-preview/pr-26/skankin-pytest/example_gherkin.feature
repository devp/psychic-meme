Feature: User Profile Management

Scenario: User updates their email address
Given a logged-in user with email "old@example.com"
When they update their email to "new@example.com"
Then their profile shows the new email
And they receive a confirmation email

Scenario: User cannot use an already registered email
Given a logged-in user
And another user already has email "taken@example.com"
When they try to update their email to "taken@example.com"
Then they see an error message
And their email remains unchanged
