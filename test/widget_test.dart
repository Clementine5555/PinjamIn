import 'package:flutter_test/flutter_test.dart';
import 'package:pinjamin/core/config/supabase_config.dart';

void main() {
  test('Supabase configuration is available', () {
    expect(SupabaseConfig.url, startsWith('https://'));
    expect(SupabaseConfig.publishableKey, startsWith('sb_publishable_'));
  });
}
