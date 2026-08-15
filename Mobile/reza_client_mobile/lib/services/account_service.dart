import '../models/family_member.dart';
import 'api_client.dart';

class AccountService {
  Future<List<FamilyMember>> getFamilyMembers(String email) async {
    final res = await apiClient.get(
      '/public/client/${Uri.encodeComponent(email)}/family-members',
    );
    final list = List<Map<String, dynamic>>.from(
      (res['familyMembers'] as List?) ?? [],
    );
    return list.map(FamilyMember.fromJson).toList();
  }

  Future<FamilyMember> createFamilyMember({
    required String clientEmail,
    required String firstName,
    String lastName = '',
    required String relationship,
    String? phone,
    String? email,
    String? avatar,
    String? gender,
  }) async {
    final res = await apiClient.post('/public/family-members', {
      'clientEmail': clientEmail,
      'firstName': firstName,
      'lastName': lastName,
      'relationship': relationship,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
      if (email != null && email.isNotEmpty) 'email': email,
      if (avatar != null && avatar.isNotEmpty) 'avatar': avatar,
      if (gender != null && gender.isNotEmpty) 'gender': gender,
    });
    return FamilyMember.fromJson(
      Map<String, dynamic>.from(res['familyMember'] as Map),
    );
  }

  Future<FamilyMember> updateFamilyMember({
    required String id,
    required String clientEmail,
    required String firstName,
    String lastName = '',
    required String relationship,
    String? phone,
    String? email,
    String? avatar,
    String? gender,
  }) async {
    final res = await apiClient.put('/public/family-members/$id', {
      'clientEmail': clientEmail,
      'firstName': firstName,
      'lastName': lastName,
      'relationship': relationship,
      if (phone != null) 'phone': phone,
      if (email != null) 'email': email,
      if (avatar != null) 'avatar': avatar,
      if (gender != null) 'gender': gender,
    });
    return FamilyMember.fromJson(
      Map<String, dynamic>.from(res['familyMember'] as Map),
    );
  }

  Future<void> deleteFamilyMember(String id, String clientEmail) async {
    await apiClient.delete(
      '/public/family-members/$id',
      query: {'clientEmail': clientEmail},
    );
  }

  Future<List<Map<String, dynamic>>> getAppointments(
    String email, {
    String sortBy = 'createdAt',
  }) async {
    final res = await apiClient.get(
      '/public/client/${Uri.encodeComponent(email)}/appointments',
      query: {'limit': '100', 'sortBy': sortBy},
    );
    return List<Map<String, dynamic>>.from(
      (res['appointments'] as List?) ?? [],
    );
  }

  Future<void> cancelAppointment(String appointmentId, String email) async {
    await apiClient.put('/public/appointments/$appointmentId/cancel', {
      'email': email,
    });
  }

  Future<List<Map<String, dynamic>>> getFavorites(String email) async {
    final res = await apiClient.get(
      '/public/client/${Uri.encodeComponent(email)}/favorites',
    );
    return List<Map<String, dynamic>>.from((res['favorites'] as List?) ?? []);
  }

  Future<Map<String, dynamic>> addFavorite(
    String email,
    String tenantId,
  ) async {
    return apiClient.post('/public/favorites', {
      'clientEmail': email,
      'tenantId': tenantId,
    });
  }

  Future<void> removeFavorite(String favoriteId, String email) async {
    await apiClient.delete(
      '/public/favorites/$favoriteId',
      query: {'clientEmail': email},
    );
  }

  Future<Map<String, dynamic>> updateProfile(
    String email,
    Map<String, dynamic> data,
  ) async {
    return apiClient.put('/public/client/${Uri.encodeComponent(email)}', data);
  }

  /// Full client profile (avatar, gender, dateOfBirth...) for the edit page.
  Future<Map<String, dynamic>> getProfile(String email) async {
    final res = await apiClient.get(
      '/public/client/${Uri.encodeComponent(email)}',
    );
    return Map<String, dynamic>.from(res['client'] as Map);
  }

  /// Step 1 — verify the current password and email a 6-digit code.
  Future<void> sendPasswordCode({
    required String email,
    required String currentPassword,
  }) async {
    await apiClient.post(
      '/public/client/${Uri.encodeComponent(email)}/send-password-code',
      {'currentPassword': currentPassword},
    );
  }

  /// Forgot password (mobile): emails a 6-digit code to the account owner.
  /// No current password required — used by the "Mot de passe oublié" flow.
  Future<void> forgotPasswordCode(String email) async {
    await apiClient.post('/public/auth/client-forgot-code', {
      'email': email.trim(),
    });
  }

  /// Step 2 — validate the emailed code and set the new password.
  Future<void> changePassword({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    await apiClient.put(
      '/public/client/${Uri.encodeComponent(email)}/change-password',
      {'code': code, 'newPassword': newPassword},
    );
  }
}

final accountService = AccountService();
