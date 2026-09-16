import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/theme/app_theme.dart';
import '../../items/data/item_repository.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({required this.itemId, super.key});

  final int itemId;

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  int _days = 1;
  bool _saving = false;

  Future<void> _rent(Item item) async {
    setState(() => _saving = true);
    try {
      var user = Supabase.instance.client.auth.currentUser;
      if (user == null) {
        final response = await Supabase.instance.client.auth
            .signInAnonymously();
        user = response.user;
      }
      if (user == null) throw const AuthException('Login anonim gagal');
      final startDate = DateTime.now();
      await Supabase.instance.client.from('rentals').insert({
        'item_id': item.id,
        'renter_id': user.id,
        'start_date': startDate.toIso8601String().split('T').first,
        'end_date': startDate
            .add(Duration(days: _days))
            .toIso8601String()
            .split('T')
            .first,
        'days': _days,
        'total_price': item.pricePerDay * _days,
        'status': 'Menunggu persetujuan',
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Permintaan sewa berhasil dibuat.')),
      );
      context.go('/transactions');
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Gagal membuat permintaan sewa.')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: FutureBuilder<Item>(
        future: itemRepository.getItem(widget.itemId),
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return const Center(child: Text('Gagal memuat checkout.'));
          }
          final item = snapshot.data!;
          final total = item.pricePerDay * _days;
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                item.title,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 24),
              DropdownButtonFormField<int>(
                initialValue: _days,
                decoration: const InputDecoration(labelText: 'Durasi sewa'),
                items: List.generate(
                  3,
                  (index) => DropdownMenuItem(
                    value: index + 1,
                    child: Text('${index + 1} hari'),
                  ),
                ),
                onChanged: (value) => setState(() => _days = value ?? 1),
              ),
              const SizedBox(height: 28),
              const Text('Total pembayaran'),
              const SizedBox(height: 6),
              Text(
                'Rp $total',
                style: const TextStyle(
                  color: AppColors.primary,
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 28),
              FilledButton(
                onPressed: _saving ? null : () => _rent(item),
                child: Text(_saving ? 'Memproses...' : 'Konfirmasi Sewa'),
              ),
            ],
          );
        },
      ),
    );
  }
}
