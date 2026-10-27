import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../config/api_config.dart';
import '../config/demo_config.dart';
import 'demo_api_client.dart';

class ApiException implements Exception {
  final String message;
  final int? status;
  ApiException(this.message, {this.status});
  @override
  String toString() => message;
}

typedef TokenGetter = Future<String?> Function();
typedef OnUnauthorized = Future<void> Function();

class ApiClient {
  ApiClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;
  String get _base => ApiConfig.baseUrl;

  /// Supplies the client session token (secure storage). Attached to every
  /// request as a Bearer token. Wired by AuthViewModel.
  TokenGetter? tokenGetter;
  OnUnauthorized? onUnauthorized;

  Future<Map<String, String>> _headers() async {
    final h = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    final token = await tokenGetter?.call();
    if (token != null && token.isNotEmpty) {
      h['Authorization'] = 'Bearer $token';
    }
    return h;
  }

  Future<Map<String, dynamic>> get(String path, {Map<String, String>? query}) async {
    // Demo mode: intercept and use mock data
    if (DemoConfig.isDemoMode) {
      return DemoApiClient.request('GET', path, query: query);
    }
    
    final parsed = Uri.parse('$_base$path');
    final uri = (query == null || query.isEmpty)
        ? parsed
        : parsed.replace(queryParameters: {
            ...parsed.queryParameters,
            ...query,
          });
    final headers = await _headers();
    final res = await _client.get(uri, headers: headers);
    return _decode(res, hadToken: headers.containsKey('Authorization'));
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body, {Map<String, String>? query}) async {
    // Demo mode: intercept and use mock data
    if (DemoConfig.isDemoMode) {
      return DemoApiClient.request('POST', path, body: body, query: query);
    }
    
    final parsed = Uri.parse('$_base$path');
    final uri = (query == null || query.isEmpty)
        ? parsed
        : parsed.replace(queryParameters: {
            ...parsed.queryParameters,
            ...query,
          });
    final headers = await _headers();
    final res = await _client.post(
      uri,
      headers: headers,
      body: jsonEncode(body),
    );
    return _decode(res, hadToken: headers.containsKey('Authorization'));
  }

  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body, {Map<String, String>? query}) async {
    // Demo mode: intercept and use mock data
    if (DemoConfig.isDemoMode) {
      return DemoApiClient.request('PUT', path, body: body, query: query);
    }
    
    final parsed = Uri.parse('$_base$path');
    final uri = (query == null || query.isEmpty)
        ? parsed
        : parsed.replace(queryParameters: {
            ...parsed.queryParameters,
            ...query,
          });
    final headers = await _headers();
    final res = await _client.put(
      uri,
      headers: headers,
      body: jsonEncode(body),
    );
    return _decode(res, hadToken: headers.containsKey('Authorization'));
  }

  Future<Map<String, dynamic>> patch(String path, [Map<String, dynamic>? body]) async {
    // Demo mode: intercept and use mock data
    if (DemoConfig.isDemoMode) {
      return DemoApiClient.request('PATCH', path, body: body);
    }
    
    final headers = await _headers();
    final res = await _client.patch(
      Uri.parse('$_base$path'),
      headers: headers,
      body: body == null ? null : jsonEncode(body),
    );
    return _decode(res, hadToken: headers.containsKey('Authorization'));
  }

  Future<Map<String, dynamic>> delete(String path, {Map<String, String>? query}) async {
    // Demo mode: intercept and use mock data
    if (DemoConfig.isDemoMode) {
      return DemoApiClient.request('DELETE', path, query: query);
    }
    
    final uri = Uri.parse('$_base$path').replace(queryParameters: query);
    final headers = await _headers();
    final res = await _client.delete(uri, headers: headers);
    return _decode(res, hadToken: headers.containsKey('Authorization'));
  }

  /// Multipart file upload (e.g. avatar) — POSTs `file` as the `avatar` field.
  Future<Map<String, dynamic>> uploadAvatar(Uint8List bytes, String filename, String contentType) async {
    if (DemoConfig.isDemoMode) {
      return DemoApiClient.request('POST', '/public/auth/upload-avatar');
    }

    final uri = Uri.parse('$_base/public/auth/upload-avatar');
    final req = http.MultipartRequest('POST', uri)
      ..headers['Accept'] = 'application/json'
      ..files.add(http.MultipartFile.fromBytes(
        'avatar',
        bytes,
        filename: filename,
        contentType: MediaType.parse(contentType),
      ));
    final streamed = await _client.send(req);
    final res = await http.Response.fromStream(streamed);
    return _decode(res);
  }

  Map<String, dynamic> _decode(http.Response res, {bool hadToken = false}) {
    Map<String, dynamic> json = {};
    if (res.body.isNotEmpty) {
      final decoded = jsonDecode(res.body);
      if (decoded is Map<String, dynamic>) {
        json = decoded;
      } else if (decoded is List) {
        json = {'data': decoded};
      }
    }
    if (res.statusCode == 401 && hadToken) {
      // Expired/invalid session on an AUTHENTICATED call — clear the stored
      // session so the user is prompted to re-login (mirrors the Pro app's
      // 401 handling). A bare 401 (e.g. failed login) never triggers this.
      unawaited(onUnauthorized?.call());
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
