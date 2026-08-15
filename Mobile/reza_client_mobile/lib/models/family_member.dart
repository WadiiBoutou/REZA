class FamilyMember {
  final String id;
  final String firstName;
  final String lastName;
  final String relationship;
  final String? phone;
  final String? email;
  final String? avatar;
  final String? gender;

  const FamilyMember({
    required this.id,
    required this.firstName,
    this.lastName = '',
    required this.relationship,
    this.phone,
    this.email,
    this.avatar,
    this.gender,
  });

  String get name => '$firstName $lastName'.trim();

  String get initials {
    final a = firstName.isNotEmpty ? firstName[0] : '';
    final b = lastName.isNotEmpty ? lastName[0] : '';
    final s = '$a$b'.toUpperCase();
    return s.isEmpty ? '?' : s;
  }

  factory FamilyMember.fromJson(Map<String, dynamic> json) {
    return FamilyMember(
      id: json['id']?.toString() ?? '',
      firstName: json['firstName']?.toString() ?? '',
      lastName: json['lastName']?.toString() ?? '',
      relationship: json['relationship']?.toString() ?? '',
      phone: json['phone']?.toString(),
      email: json['email']?.toString(),
      avatar: json['avatar']?.toString(),
      gender: json['gender']?.toString(),
    );
  }
}
