import 'package:flutter/foundation.dart';

class ApiConfig {
  static const String _fallbackBaseUrl = 'http://localhost:4000';

  static String get baseUrl {
    if (kIsWeb) {
      return _fallbackBaseUrl;
    }

    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'http://10.0.2.2:4000';
      case TargetPlatform.iOS:
      case TargetPlatform.macOS:
      case TargetPlatform.windows:
      case TargetPlatform.linux:
      case TargetPlatform.fuchsia:
        return _fallbackBaseUrl;
    }
  }

  static Map<String, String> headers({String? token, bool json = true}) {
    final headers = <String, String>{};
    if (json) {
      headers['Content-Type'] = 'application/json';
    }
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }
}
