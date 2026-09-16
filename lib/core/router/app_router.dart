import 'package:go_router/go_router.dart';

import '../../features/home/presentation/home_screen.dart';
import '../../features/checkout/presentation/checkout_screen.dart';
import '../../features/items/presentation/item_detail_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/search/presentation/search_screen.dart';
import '../../features/transactions/presentation/transactions_screen.dart';
import '../../shared/widgets/main_shell.dart';

final appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (context, state, shell) => MainShell(shell: shell),
      branches: [
        StatefulShellBranch(
          routes: [GoRoute(path: '/', builder: (_, _) => const HomeScreen())],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(path: '/search', builder: (_, _) => const SearchScreen()),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/transactions',
              builder: (_, _) => const TransactionsScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
          ],
        ),
      ],
    ),
    GoRoute(
      path: '/items/:id',
      builder: (_, state) =>
          ItemDetailScreen(itemId: int.parse(state.pathParameters['id']!)),
    ),
    GoRoute(
      path: '/items/:id/checkout',
      builder: (_, state) =>
          CheckoutScreen(itemId: int.parse(state.pathParameters['id']!)),
    ),
  ],
);
