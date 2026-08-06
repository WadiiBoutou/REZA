import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';

class ApiException implements Exception {
  final String message;
  final int? status;
  ApiException(this.message, {this.status});
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;
  String get _base => ApiConfig.baseUrl;

  Future<Map<String, dynamic>> get(String path, {Map<String, String>? query}) async {
    final parsed = Uri.parse('$_base$path');
    final uri = (query == null || query.isEmpty)
        ? parsed
        : parsed.replace(queryParameters: {
            ...parsed.queryParameters,
            ...query,
          });
    final res = await _client.get(uri, headers: _headers);
    return _decode(res);
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body, {Map<String, String>? query}) async {
    final parsed = Uri.parse('$_base$path');
    final uri = (query == null || query.isEmpty)
        ? parsed
        : parsed.replace(queryParameters: {
            ...parsed.queryParameters,
            ...query,
          });
    final res = await _client.post(
      uri,
      headers: _headers,
      body: jsonEncode(body),
    );
    return _decode(res);
  }

  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body, {Map<String, String>? query}) async {
    final parsed = Uri.parse('$_base$path');
    final uri = (query == null || query.isEmpty)
        ? parsed
        : parsed.replace(queryParameters: {
            ...parsed.queryParameters,
            ...query,
          });
    final res = await _client.put(
      uri,
      headers: _headers,
      body: jsonEncode(body),
    );
    return _decode(res);
  }

  Future<Map<String, dynamic>> patch(String path, [Map<String, dynamic>? body]) async {
    final res = await _client.patch(
      Uri.parse('$_base$path'),
      headers: _headers,
      body: body == null ? null : jsonEncode(body),
    );
    return _decode(res);
  }

  Future<Map<String, dynamic>> delete(String path, {Map<String, String>? query}) async {
    final uri = Uri.parse('$_base$path').replace(queryParameters: query);
    final res = await _client.delete(uri, headers: _headers);
    return _decode(res);
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

  Map<String, dynamic> _decode(http.Response res) {
    Map<String, dynamic> json = {};
    if (res.body.isNotEmpty) {
      final decoded = jsonDecode(res.body);
      if (decoded is Map<String, dynamic>) {
        json = decoded;
      } else if (decoded is List) {
        json = {'data': decoded};
      }
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(
        (json['message'] as String?) ?? 'Erreur serveur (${res.statusCode})',
        status: res.statusCode,
      );
    }
    return json;
  }
}

final apiClient = ApiClient();
