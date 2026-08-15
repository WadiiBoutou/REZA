/// Represents a person selected or entered for a group booking.
/// This is the result returned from GroupPersonPickerScreen.
class GroupPerson {
  final String firstName;
  final String lastName;
  final String? phone;
  final String? email;
  final String? relationship;
  final String? familyMemberId; // Non-null if selected from existing proches
  final bool saveAsProche; // Whether to persist as a new proche
  final String? avatar; // Profile picture (http URL or base64 data: URI)

  const GroupPerson({
    required this.firstName,
    this.lastName = '',
    this.phone,
    this.email,
    this.relationship,
    this.familyMemberId,
    this.saveAsProche = false,
    this.avatar,
  });

  String get displayName => '$firstName $lastName'.trim();
}
